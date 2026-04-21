# Whispr Mini

Whispr Mini is the Telegram Mini App frontend for Whispr, an AI-powered reminder assistant.
It provides a mobile-friendly interface for creating, viewing, and managing reminders.

## Features

- Dashboard for active reminders
- Reminder creation flow
- Reminder details and status tracking
- Archive view for completed reminders
- Insights and settings screens
- Telegram Web App SDK integration

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 3
- React Query
- Axios
- Framer Motion
- Telegram Web App SDK

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer

## Getting Started

1. Install dependencies:

	npm install

2. Start the development server:

	npm run dev

3. Open the local URL shown in the terminal.

## Available Scripts

- npm run dev: Start Vite dev server
- npm run build: Create a production build
- npm run preview: Preview the production build locally
- npm run lint: Run ESLint

## Project Structure

src/
- api/: Axios setup and API client
- components/: Shared UI components
- hooks/: Custom React hooks
- screens/: Page-level views
- utils/: Helper functions and Telegram helpers
- lib/: Local library shims and aliases

## Configuration Notes

- This app is intended to run inside Telegram as a Mini App.
- Ensure backend API endpoints are configured in the API client.
- Vite alias for lucide-react is mapped to a local shim in vite.config.js.

## Build and Deployment

1. Create a production bundle:

	npm run build

2. Deploy the generated dist/ folder to your static hosting provider.

This project includes vercel.json for Vercel-based deployment.

## Related Project

The backend service and bot logic live in the root Whispr project.
See the root README for backend setup and environment configuration.

## License

This project is licensed under the same license as the root repository.

## Arigato
