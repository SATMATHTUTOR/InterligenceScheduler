const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const { writeToGoogleSheet } = require("./write_data.sheet");

exports.webhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const credentials = require("./credentials.json");
    const auth = new GoogleAuth({ credentials });
    const sheets = google.sheets({ version: "v4", auth });
    const events = req.body.events;

    await Promise.all(
      events.map(async (event) => {
        console.log("Received LINE event:", event);
        if (isValidMessage(event)) {
          const messageText = event.message.text.trim().toLowerCase();

          if (messageText.startsWith("sbot")) {
            const { teacherName, day, time } = parseMessage(messageText);
            if (!teacherName || !day || !time) {
              const invalidFormatMessage =
                "❌ Invalid format ❌" +
                "\n" +
                "Format: sbot Teacher / Day / Time";
              return reply(event.replyToken, [
                { type: "text", text: invalidFormatMessage },
              ]);
            }

            try {
              const thaiDate = new Date().toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              });

              const successMessage = await writeToGoogleSheet(sheets, {
                date: thaiDate,
                time,
                day,
                teacherName,
                money: "N/A", // Assuming this is not provided in the message
                studentName: "N/A", // Assuming this is not provided in the message
                type: "N/A", // Assuming this is not provided in the message
              });

              const linePayload = [{ type: "text", text: successMessage }];

              const lineResponse = await reply(event.replyToken, linePayload);
              console.log("LINE Response:", lineResponse.data);
            } catch (error) {
              console.error("Error processing message:", error);
            }
          } else if (messageText === "sbot ขอ format หน่อย") {
            // Reply with the format
            const formatMessage = "Format: sbot Teacher / Day / Time";
            const lineResponse = await reply(event.replyToken, [
              { type: "text", text: formatMessage },
            ]);
            console.log("LINE Response:", lineResponse.data);
          } else if (messageText === "bot clear testdata") {
            const clearTestCacheMessage = await clearTestCache(sheets);
            const lineResponse = await reply(event.replyToken, [
              { type: "text", text: clearTestCacheMessage },
            ]);
            console.log("LINE Response:", lineResponse.data);
          }
        }
      })
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).send("Internal Server Error");
  }

  return res.status(200).send("OK");
});

const isValidMessage = (event) =>
  event.type === "message" &&
  event.message.type === "text" &&
  event.message.text.toLowerCase().startsWith("sbot");

const parseMessage = (message) => {
  const match = message.match(/^sbot\s+([^/]+)\s*\/\s*([^/]+)\s*\/\s*([^/]+)/i);
  if (match) {
    const [, teacherName, day, time] = match;
    return {
      teacherName: capitalizeFirstLetter(teacherName.trim()),
      day: capitalizeFirstLetter(day.trim()),
      time: time.trim(),
    };
  }
  return {};
};

const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const reply = async (token, payload) => {
  const response = await axios({
    method: "post",
    url: `https://api.line.me/v2/bot/message/reply`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`,
    },
    data: { replyToken: token, messages: payload },
  });

  console.log("LINE Response:", response.data);

  if (response.data && response.data.code) {
    console.error("Error sending LINE message. LINE API error:", response.data);
    return null;
  }

  return response;
};
//
