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

  const startHour = parseInt(startTime.split(".")[0]);
  const startMinute = parseInt(startTime.split(".")[1]) || 0; // Handle cases where minutes are not provided

  const endHour = parseInt(endTime.split(".")[0]);
  const endMinute = parseInt(endTime.split(".")[1]) || 0; // Handle cases where minutes are not provided

  const timeSlots = Math.ceil(
    ((endHour - startHour) * 60 + (endMinute - startMinute)) / 30
  );

  const timeSlotsData = [];

  let isFull = false;

  for (let i = 0; i < timeSlots; i++) {
    const slotStartHour = startHour + Math.floor((startMinute + i * 30) / 60);
    const slotStartMinute = (startMinute + i * 30) % 60;

    const slotStartTime = `${slotStartHour}:${slotStartMinute
      .toString()
      .padStart(2, "0")}`;

    const slotEndHour =
      startHour + Math.floor((startMinute + (i + 1) * 30) / 60);
    const slotEndMinute = (startMinute + (i + 1) * 30) % 60;

    const slotEndTime = `${slotEndHour}:${slotEndMinute
      .toString()
      .padStart(2, "0")}`;

    timeSlotsData.push([slotStartTime, slotEndTime]);
  }

  try {
    for (const timeSlot of timeSlotsData) {
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
      const columnIndex = getSheetColumnIndex(timeSlot[0]);
      const dayIndex = daysOfWeek.indexOf(data.day) + 2; // Increase index by 2

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
          `Slot already filled at ${timeSlot[0]}, ${timeSlot[1]}. Sending a message and doing nothing.`
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
const getSheetColumnIndex = (startTime) => {
  const [hoursStr, minutesStr] = startTime.split(":");
  const hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);

  let columnIndex = (hours - 8) * 2; // Start from 8:00 AM

  if (minutes >= 30) {
    columnIndex += 1; // Adjust index for .30 case
  }

  return columnIndex + 2; // Adjusted index by 2
};

const getColumnLetter = (index) => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const quotient = Math.floor((index - 1) / 26);
  const remainder = (index - 1) % 26;

  return quotient > 0
    ? letters.charAt(quotient - 1) + letters.charAt(remainder)
    : letters.charAt(remainder);
};

const getAvailableSlots = async (sheets, subsetName) => {
  const credentials = require("./credentials.json");
  const client = await auth.getClient({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const spreadsheetId = process.env.SPREADSHEET_ID;

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const columnTime = [
    "8.00-8.30",
    "8.30-9.00",
    "9.00-9.30",
    "9.30-10.00",
    "10.00-10.30",
    "10.30-11.00",
    "11.00-11.30",
    "11.30-12.00",
    "12.00-12.30",
    "12.30-13.00",
    "13.00-13.30",
    "13.30-14.00",
    "14.00-14.30",
    "14.30-15.00",
    "15.00-15.30",
    "15.30-16.00",
    "16.00-16.30",
    "16.30-17.00",
    "17.00-17.30",
    "17.30-18.00",
    "18.00-18.30",
    "18.30-19.00",
    "19.00-19.30",
    "19.30-20.00",
    "20.00-20.30",
    "20.30-21.00",
    "21.00-21.30",
    "21.30-22.00",
  ];

  try {
    const range = `${subsetName}!B2:AC8`; // Define the range for the time slots

    // Retrieve the data from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      auth: client,
    });

    const data = response?.data?.values;
    // Create 7 arrays for 7 days
    const weekArray = [[], [], [], [], [], [], []];

    for (let i = 0; i < 7; i++) {
      if (!data[i] || data[i].length < 28) {
        const slots = data[i] || [];
        weekArray[i] = slots.concat(
          Array.from({ length: 28 - slots.length }, () => "")
        );
      } else {
        const slots = data[i].slice(0, 28);
        weekArray[i] = slots.map((slot) => (slot === "จองแล้ว" ? slot : ""));
      }
    }

    const bookedSlots = {};
    for (let i = 0; i < 7; i++) {
      bookedSlots[daysOfWeek[i]] = weekArray[i].reduce((acc, slot, index) => {
        if (slot === "จองแล้ว") {
          acc.push(columnTime[index]);
        }
        return acc;
      }, []);
    }

    const bookedSlotText = Object.keys(bookedSlots)
      .map((day) => {
        return `${day}: ${bookedSlots[day].join(", ") || "No slots booked"}`;
      })
      .join("\n");

    console.log(bookedSlotText);

    const mergedBookedSlots = mergeTimeSlots(bookedSlotText);
    const sortedBookedSlots = sortTimeSlots(mergedBookedSlots);

    const message = `Available slots for ${subsetName}:\n${sortedBookedSlots}`;
    return message;
  } catch (error) {
    console.error("Error getting available slots:", error);
    throw error;
  }
};

function mergeTimeSlots(slotsText) {
  // Convert the text into an array of objects
  const slotsArray = slotsText
    .split("\n")
    .filter((slot) => slot.trim() !== "")
    .map((slot) => {
      const [day, timeSlot] = slot.split(": ");
      const times = timeSlot.split(", ");
      return { day, times };
    });

  // Sort the array based on day and time
  slotsArray.sort((a, b) => {
    if (a.day < b.day) return -1;
    if (a.day > b.day) return 1;
    return 0;
  });

  // Merge consecutive time slots for each day
  const mergedSlots = [];
  slotsArray.forEach((slot) => {
    const mergedTimes = [];
    let currentSlot = slot.times[0];
    for (let i = 1; i < slot.times.length; i++) {
      const [start1, end1] = currentSlot.split("-");
      const [start2, end2] = slot.times[i].split("-");
      if (end1 === start2) {
        currentSlot = `${start1}-${end2}`;
      } else {
        mergedTimes.push(currentSlot);
        currentSlot = slot.times[i];
      }
    }
    mergedTimes.push(currentSlot);
    mergedSlots.push({ day: slot.day, times: mergedTimes });
  });

  return mergedSlots;
}

function sortTimeSlots(slotsText) {
  // Convert the text into an array of objects
  const slotsArray = slotsText
    .split("\n")
    .filter((slot) => slot.trim() !== "")
    .map((slot) => {
      const [day, timeSlot] = slot.split(": ");
      const times = timeSlot.split(", ");
      return { day, times };
    });

  // Sort the array based on day
  slotsArray.sort((a, b) => {
    if (a.day < b.day) return -1;
    if (a.day > b.day) return 1;
    return 0;
  });

  return slotsArray;
}

module.exports = {
  writeToGoogleSheet,
  getAvailableSlots,
};
