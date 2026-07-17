import { Request, Response } from 'express';

// Shared in-memory databases to facilitate actual multi-channel real-time sync between roles
let serverChats: any[] = [];
let serverNotifications: any[] = [];
let serverPushLogs: any[] = [];

export const getChats = (req: Request, res: Response) => {
  res.json(serverChats);
};

export const createChat = (req: Request, res: Response) => {
  const msg = req.body;
  if (msg && msg.id) {
    if (!serverChats.some(c => c.id === msg.id)) {
      serverChats.push(msg);
    }
  }
  res.json(serverChats);
};

export const getNotifications = (req: Request, res: Response) => {
  res.json(serverNotifications);
};

export const createNotification = (req: Request, res: Response) => {
  const notif = req.body;
  if (notif && notif.id) {
    if (!serverNotifications.some(n => n.id === notif.id)) {
      serverNotifications.push(notif);
    }
  }
  res.json(serverNotifications);
};

export const getPushLogs = (req: Request, res: Response) => {
  res.json(serverPushLogs);
};

export const createPushLog = (req: Request, res: Response) => {
  const log = req.body;
  if (log && log.id) {
    if (!serverPushLogs.some(p => p.id === log.id)) {
      serverPushLogs.push(log);
    }
  }
  res.json(serverPushLogs);
};
