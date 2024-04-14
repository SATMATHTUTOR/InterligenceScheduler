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
    for (const timeSlot of timeSlotsData) {
      const subsetName = data.teacherName; // Use teacher name as the subset (sheet) name
      const row = data.day; // Use day as the row index
      const columnIndex = getColumnIndex(timeSlot[0]); // Get the column index based on the start time

      const range = `${subsetName}!${getColumnLetter(
        columnIndex
      )}${row}:${getColumnLetter(columnIndex + 1)}${row}`; // Update range to match the correct slot
      const values = [timeSlot];

      // Check if the target slot is empty
      const checkResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        auth: client,
      });
      const existingValue = checkResponse?.data?.values?.[0]?.[0];

      if (!existingValue) {
        // Target slot is empty, write data
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          auth: client,
          valueInputOption: "USER_ENTERED",
          resource: {
            values,
          },
        });

        console.log(
          `Data successfully written to Google Sheet (${subsetName}):`,
          response.data
        );
      } else {
        // Target slot is not empty, write "ไม่ว่าง" (Not Available)
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          auth: client,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [["ไม่ว่าง"]],
          },
        });

        console.log(
          `Slot not empty, wrote "ไม่ว่าง" to Google Sheet (${subsetName}):`,
          response.data
        );
      }
    }

    const successMessage = `Data successfully written to Google Sheet (${data.day})`;
    console.log("Total Money Received by Teachers");
    return successMessage;
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

module.exports = {
  writeToGoogleSheet,
};
