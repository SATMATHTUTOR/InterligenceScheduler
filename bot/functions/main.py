# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn
from firebase_admin import initialize_app
import os
import requests

initialize_app()

LINE_MESSAGING_API = "https://api.line.me/v2/bot/message/reply"
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", None)


@https_fn.on_request()
def webhook(req: https_fn.Request) -> https_fn.Response:
    try:
        req_data = req.get_json()
        events = req_data["events"]

        for event in events:
            if event["type"] == "message" and event["message"]["type"] == "text":
                handle_text_message(event)

        return https_fn.Response("Message processed successfully", status=200)
    except Exception as e:
        print(f"Error in webhook: {str(e)}")
        import traceback

        traceback.print_exc()
        return https_fn.Response(f"Error: {str(e)}", status=500)


def generate_schedule(message_text):
    message = ""
    if message_text[:8] == "schedule":
        raw_message = message_text.split("schedule")[1]
        message = raw_message.strip()
    return message


def handle_text_message(event):
    reply_token = event["replyToken"]
    message_text = event["message"]["text"]

    message = generate_schedule(message_text)

    if message is "":
        message = "no schedule text found. Please try again."

    payload = {
        "replyToken": reply_token,
        "messages": [{"type": "text", "text": message}],
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
    }

    response = requests.post(LINE_MESSAGING_API, headers=headers, json=payload)

    if response.status_code != 200:
        raise Exception(f"Line Messaging API request failed: {response.text}")
