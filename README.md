# ChatGPT Slack Bot ( Serverless AWS Lambda )

This app uses the library at https://github.com/transitive-bullshit/chatgpt-api

https://github.com/MarkusGalant/chatgpt-slackbot-serverless 여기서 fork해왔습니다.

특정 채널의 모든 메시지에 대해서 ChatGPT가 reply로 답변을 해줍니다.

그 외의 채널에서는 `@수다쟁이GPT`를 멘션하고 질문을 하면 ChatGPT가 답변을 해줄수 있는데, 이 답변에 대해서는 ChatGPT가 맥락을 기억하지 않습니다.

## Setup

Setup a Slack app by following the guide at https://slack.dev/bolt-js/tutorial/getting-started

Set scopes to Bot Token Scopes in OAuth & Permission:

```
app_mentions:read
channels:history
channels:join
channels:read
groups:history
groups:read
```

Set scopes in Event Subscriptions - Subscribe to bot events

```
app_mention
```


Set scopes in Event Subscriptions - Subscribe to events on behalf of users

```
message.groups
message.channels
```

### Local development

Setup AWS account for Lmabda on your PC
```
aws configure
```

Create new `.env` and update the information
```
cp .env.example .env
```
Put your secrets

Install

```
yarn install
```

Run localy

```
yarn start
```

Make Public URL https://slack.dev/bolt-js/deployments/aws-lambda#run-the-app-locally

```
yarn serve
```

## Deployment

In order to deploy the example, you need to run the following command:

```
$ serverless deploy
```

## Usage

You can send a direct message to the Slack Bot, also you can use `reset` message to clear session.

![](docs/dm.png)


You can invite it to a channel and mention it @ChatGPT Bot <your question>

![](docs/mention.png)

## License

Nest is [MIT licensed](LICENSE).