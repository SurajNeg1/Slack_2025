import "../instrument.mjs";
import express from 'express';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { functions, inngest } from './config/inngest.js';
import  chatRoutes  from './routes/chat.route.js';
import * as Sentry from "@sentry/node";

const app = express();

app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);

app.get("/debug-sentry", (req, res) => {
  throw new Error("My first Sentry error!");
});


Sentry.setupExpressErrorHandler(app);

app.get('/', (req, res) => {
  res.send('Hello World!');
});                     

const startServer = async () => {
  try {
    await connectDB();
    if (ENV.NODE_ENV !== "production") {
      app.listen(ENV.PORT, () => {
        console.log("Server started on port:", ENV.PORT);
      });
    }
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1); // Exit the process with a failure code
  }
};

startServer();

export default app;