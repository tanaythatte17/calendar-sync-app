import { getAllCalendarAccounts, getAllUserEvents } from "../utils/userUtils.js";

export const getCalendarAccountsHandler = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Unauthorized");

    const accounts = await getAllCalendarAccounts(userId);
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).send("Could not fetch calendar accounts");
  }
};

export const getUserEventsHandler = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Unauthorized");

    const events = await getAllUserEvents(userId);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send("Could not fetch user events");
  }
};