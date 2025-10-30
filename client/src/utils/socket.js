// utils/socket.js
import { emitNotification } from "../server.js";

export const sendRealTimeNotification = async (notification) => {
  await emitNotification(notification);
};