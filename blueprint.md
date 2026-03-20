# Lotto Number Generator - Blueprint

## Overview

This application generates lotto numbers for users. Initially, it provided purely random numbers. The current version generates numbers based on a weighted probability derived from a sample of historical winning numbers, increasing the chances of picking statistically more frequent numbers.

## Project Outline & Features

### Version 1: Random Generator
- **HTML:** Basic structure with a title, a "Generate" button, and a container for the numbers.
- **CSS:** Simple styling for the button and number display. Numbers are shown in green circles.
- **JavaScript:** A click listener on the button generates 6 unique random numbers between 1 and 45.

### Version 2 (Current): Statistical Generator
- **Style:**
  - The color of the number circles is now determined by the number itself, creating a rainbow effect (`hsl`).
  - The "Generate" button color is changed to blue.
  - Added a hover effect to the number circles.
- **Design:** The overall layout remains a simple, centered component.
- **Features:**
  - **Historical Data:** Includes a built-in, static dataset of past winning lotto numbers.
  - **Weighted Probability:** The JavaScript logic has been updated to:
    1. Calculate the frequency of each number from the historical data.
    2. Create a "weighted pool" of numbers, where more frequent numbers appear more often.
    3. Generate 6 unique numbers by randomly picking from this weighted pool.
  - **Colorful Display:** The generated numbers are displayed with a color corresponding to their value, making the result more visually appealing.

## Current Request Plan

**Request:** "로또가 시행된 년도 이래로 당첨 번호를 통계적으로 반영해서 확률이 높은 번호가 나오도록 바꿔줘" (Change it so that numbers with a higher probability appear, reflecting the winning numbers statistically since the lottery began.)

**Plan:**
1.  **[Done] Create `blueprint.md`:** Document the project's purpose, features, and the plan for the current request.
2.  **[Done] Update JavaScript (`main.js`):**
    *   Embed a sample of historical lotto winning numbers.
    *   Implement logic to calculate the frequency of each number.
    *   Create a new number generation function that uses a weighted pool based on these frequencies to increase the probability of selecting historically common numbers.
3.  **[Done] Update CSS (`style.css`):**
    *   Change the button color for a refreshed look.
    *   Remove the static background color from the `.number` class.
    *   Modify the JavaScript to apply a dynamic background color to each number circle based on its value (using HSL colors) for better visual feedback.
4.  **[Done] Inform User:** Notify the user that the changes have been implemented and explain the new logic.
