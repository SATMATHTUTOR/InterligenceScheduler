const { google } = require("googleapis");
const { auth } = require("google-auth-library");

const writeToGoogleSheet = async (sheets, data) => {
  const credentials = require("./credentials.json");
  const client = await auth.getClient({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const type = data.type || "N/A";

  const [startTime, endTime] = data.time.split("-");

  const timeSlots = (parseInt(endTime) - parseInt(startTime)) * 2;

  const timeSlotsData = [];

  let isFull = false;
  let timeSlot; // Declare timeSlot outside the loop

  for (let i = 0; i < timeSlots; i++) {
    const slotStartTime = `${parseInt(startTime) + Math.floor(i / 2)}:${
      i % 2 === 0 ? "00" : "30"
    }`;
    const slotEndTime = `${parseInt(startTime) + Math.floor(i / 2)}:${
      i % 2 === 0 ? "30" : "00"
    }`;
    timeSlotsData.push([slotStartTime, slotEndTime]);
  }

  try {
    for (timeSlot of timeSlotsData) {
      const subsetName = data.teacherName;
      const daysOfWeek = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const columnIndex = getColumnIndex(timeSlot[0]);
      const dayIndex = daysOfWeek.indexOf(data.day) + 2;

      const range = `${subsetName}!${getColumnLetter(
        columnIndex
      )}${dayIndex}:${getColumnLetter(columnIndex)}${dayIndex}`;

      const checkResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        auth: client,
      });
      const existingValue = checkResponse?.data?.values?.[0]?.[0];

      if (!existingValue) {
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          auth: client,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [["จองแล้ว"]],
          },
        });

        console.log(
          `Data successfully written to Google Sheet (${subsetName}):`,
          response.data
        );
      } else {
        console.log(
          `Slot already filled at ${timeSlot[0]}, ${
            timeSlot[-1]
          }. Sending a message and doing nothing.`
        );
        isFull = true;
      }
    }

    if (isFull) {
      const message = `Slot already filled Please choose another slot.`;
      console.log(message);
      return message;
    } else {
      const successMessage = `Data successfully written to Google Sheet (${data.day})+ (${data.teacherName}): ${data.time} (${type}`;
      console.log("Total Money Received by Teachers");
      return successMessage;
    }
  } catch (error) {
    console.error("Error writing to Google Sheet:", error);
    throw error;
  }
};

const getColumnIndex = (startTime) => {
  const hours = parseInt(startTime.split(":")[0]);
  const minutes = parseInt(startTime.split(":")[1]);

  return (hours - 8) * 2 + (minutes === 30 ? 1 : 0) + 1;
};

const getColumnLetter = (index) => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const quotient = Math.floor((index - 1) / 26);
  const remainder = (index - 1) % 26;

  return quotient > 0
    ? letters.charAt(quotient - 1) + letters.charAt(remainder)
    : letters.charAt(remainder);
};

const getConsecutiveAvailableSlots = async (sheets, teacherName) => {
  const bookedSlots = await getAvailableSlots(sheets, teacherName);
  const availableSlots = [];
  let currentSlot = null;

  for (const slot of bookedSlots) {
    if (slot !== "จองแล้ว") {
      if (!currentSlot) {
        currentSlot = { start: slot, end: slot };
      } else if (slot === incrementTime(currentSlot.end)) {
        currentSlot.end = slot;
      } else {
        availableSlots.push(currentSlot);
        currentSlot = { start: slot, end: slot };
      }
    } else {
      if (currentSlot) {
        availableSlots.push(currentSlot);
        currentSlot = null;
      }
    }
  }

  if (currentSlot) {
    availableSlots.push(currentSlot);
  }

  console.log(
    `Consecutive available slots for ${teacherName}:`,
    availableSlots
  );
  return availableSlots;
};

// Helper function to increment time by 30 minutes
const incrementTime = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  const newMinutes = (minutes + 30) % 60;
  const newHours = hours + Math.floor((minutes + 30) / 60);
  return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(
    2,
    "0"
  )}`;
};

module.exports = {
  writeToGoogleSheet,
  getAvailableSlots,
};
