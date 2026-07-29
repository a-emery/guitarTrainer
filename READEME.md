# Guitar Trainer

Guitar Trainer is a web-based metronome and practice tool designed to help guitarists (and other musicians) with rhythm, fretboard memorization, and Nashville Number System practice.

## Application Functionality

The Guitar Trainer application provides the following key features:

-   **Fretboard Trainer:** Helps with fretboard memorization by displaying random strings and notes, prompting the user to find them on their guitar.
-   **Nashville Number System Trainer:** Assists in learning the Nashville Number System by displaying random scale degrees (numbers) and revealing the corresponding chord in a chosen key.
-   **Metronome:** A customizable metronome with adjustable tempo (BPM) and an accent beat on the first beat of each measure.
-   **Timer:** A practice timer that can be enabled to run concurrently with the metronome. The timer can be reset and will automatically restart its countdown upon completion.

The application aims to provide a seamless and effective practice experience for musicians.

## Running the Application Locally

To run this application locally, you will need a development web server. A great option is `live-server` because it automatically reloads the page when you make changes to the code.

### Using `live-server` (Requires Node.js)

If you have Node.js and npm installed, you can follow these steps:

1.  **Install `live-server` globally (if you haven't already):**
    ```bash
    npm install -g live-server
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd /path/to/your/guitar-trainer-project
    ```
3.  **Start the server:**
    ```bash
    live-server
    ```
4.  **Open in browser:**
    Your browser should automatically open to the correct address (usually `http://127.0.0.1:8080`).
```
<!--
[PROMPT_SUGGESTION]Can you add instructions to the README on how to deploy the application to GitHub Pages?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Add a section to the README explaining the project structure and the purpose of each JavaScript file.[/PROMPT_SUGGESTION]
