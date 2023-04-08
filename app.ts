import { APIGatewayProxyHandler } from 'aws-lambda';
import Slack from '@slack/bolt'
import { ChatGPTAPI } from "chatgpt";
import debounce from 'debounce-promise';

const MESSAGE_PREFIX = ":robot_face: "
const addMessagePrefix = (text: string) => MESSAGE_PREFIX + text;

const channelsToReplyAll = new Set<string>((process.env.CHANNEL_IDS_TO_REPLY_EVERY_MESSAGE || '').split(','));

const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY!,
})

const awsLambdaReceiver = new Slack.AwsLambdaReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const app = new Slack.App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: awsLambdaReceiver,
    processBeforeResponse: true
});

const updateMessage = debounce(async ({ channel, ts, text, payload }: any) => {
    await app.client.chat.update({
        channel: channel,
        ts: ts,
        text: text,
        metadata: payload ? {
            event_type: "chat_gpt",
            event_payload: payload
        } : undefined
    });
}, 200);

app.event("app_mention", async ({ event, say }) => {
    console.log('app_mention channel', event.channel);
    if (channelsToReplyAll.has(event.channel)) {
        return;
    }

    const question = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, '');

    const ms = await say({
        channel: event.channel,
        text: addMessagePrefix(':thinking_face:'),
    });

    const answer = await api.sendMessage(question, {
        // Real-time update
        onProgress: async (answer) => {
            await updateMessage({
                channel: ms.channel!,
                ts: ms.ts!,
                text: addMessagePrefix(answer.text),
            });
        }
    });

    await updateMessage({
        channel: ms.channel!,
        ts: ms.ts!,
        text: addMessagePrefix(`${answer.text} :done:`),
    });
});

app.message("reset", async ({ message, say }) => {
    console.log('reset channel', message.channel);

    await say({
        channel: message.channel,
        text: addMessagePrefix('I reset your session'),
    });
});

app.message(async ({ event, message, say }) => {
    const isUserMessage = message.type === "message" && !message.subtype && !message.bot_id;

    if(
      !channelsToReplyAll.has(message.channel)
        || !(isUserMessage && message.text && message.text !== "reset")
        || message.text.startsWith(MESSAGE_PREFIX)
    ){
        return;
    }

    console.log('user channel', message.channel);

    const { messages } = await app.client.conversations.history({
        channel: message.channel,
        latest: message.ts,
        inclusive: true,
        include_all_metadata: true,
        limit: 20
    });

    const { messages: replies } = await app.client.conversations.replies({
        channel: message.channel,
        ts: message.thread_ts || message.ts,
        include_all_metadata: true
    });

    const gptReplies = replies?.filter(it => it.metadata?.event_type === "chat_gpt")?.map(it => it.metadata?.event_payload)
    const previous = gptReplies?.[gptReplies.length - 1] as any || {
        parentMessageId: undefined,
        conversationId: undefined
    };

    const thread_ts = (messages || []).filter(it => !it.text?.startsWith(MESSAGE_PREFIX)).map(it => it.thread_ts || it.ts)[0];
    const ms = await say({
        channel: message.channel,
        text: addMessagePrefix(':thinking_face:'),
        thread_ts,
    });
    // console.log("==================================================================")
    // console.log("message.ts", message.ts)
    // console.log("message.thread_ts", message.thread_ts)
    // console.log("replies metadata: ", replies?.map(it => ({
    //     ts: it.ts,
    //     thread_ts: it.thread_ts,
    //     text: it.text,
    //     metadata: it.metadata
    // })))
    // console.log("previous", previous)
    // console.log("==================================================================")

    try {
        const answer = await api.sendMessage(message.text, {
            parentMessageId: previous.parentMessageId,
            conversationId: previous.conversationId,
            onProgress: async (answer) => {
                // Real-time update
                await updateMessage({
                    channel: ms.channel,
                    ts: ms.ts,
                    text: addMessagePrefix(answer.text),
                    payload: answer,
                });
            }
        });


        await updateMessage({
            channel: ms.channel,
            ts: ms.ts,
            text: addMessagePrefix(`${answer.text} :done:`),
            payload: answer,
        });
    } catch(error) {
        console.error(error);

        if(error instanceof Error) {
            await app.client.chat.update({
                channel: ms.channel!,
                ts: ms.ts!,
                text: addMessagePrefix(`:goose_warning: ${error.toString()}`)
            });
        }
    }
});

app.error((error) => {
    console.error(error);

    return Promise.resolve();
});

export const handler: APIGatewayProxyHandler = async (event, context, callback) => {
    if(event.headers['X-Slack-Retry-Num']) {
        return { statusCode: 200, body: "ok" }
    }
    const handler = await awsLambdaReceiver.start();

    return handler(event, context, callback);
}