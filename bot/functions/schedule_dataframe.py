import re
import gspread
import os


def extract_schedule_info(schedule_text):
    pattern = r"schedule\s+(\w+)/(\w+)\s+/\s+(\d+-\d+)\s+/\s+(.*)"
    match = re.match(pattern, schedule_text)
    if match:
        teacher = match.group(1)
        day = match.group(2)
        time_range = match.group(3)
        student = match.group(4)
        return teacher, day, time_range, student
    else:
        return None
