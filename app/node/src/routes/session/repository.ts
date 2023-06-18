import { RowDataPacket } from "mysql2";
import pool from "../../util/mysql";
import { Session } from "../../model/types";
import { convertDateToString } from "../../model/utils";

let sessions: Session[] = [];

const searchSessionByUserId = (userId: string) => {
  for (const session of sessions) {
    if (session.userId == userId) {
      return session
    }
  }
  return undefined;
}

const searchSessionBySessionId = (sessionId: string) => {
  for (const session of sessions) {
    if (session.sessionId == sessionId) {
      return session
    }
  }
  return undefined;
}

const cacheSession = (session: Session) => {
  sessions.push(session);
}

export const removeSessionsByUserId = (userId: string) => {
  sessions = sessions.filter(session => session.userId !== userId);
};

export const getSessionByUserId = async (
  userId: string
): Promise<Session | undefined> => {
  let session: Session | undefined;
  session = searchSessionByUserId(userId);
  if (session) {
    return session;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT session_id, linked_user_id, created_at FROM session WHERE linked_user_id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) {
    return;
  }

  session = {
    sessionId: rows[0].session_id,
    userId: rows[0].linked_user_id,
    createdAt: convertDateToString(rows[0].created_at),
  }

  return session
};

export const createSession = async (
  sessionId: string,
  userId: string,
  now: Date
) => {
  await pool.query(
    "INSERT INTO session (session_id, linked_user_id, created_at) VALUES (?, ?, ?)",
    [sessionId, userId, now]
    );
    cacheSession({
      sessionId: sessionId,
      createdAt: convertDateToString(now),
      userId: userId
    })
};

export const getSessionBySessionId = async (
  sessionId: string
): Promise<Session | undefined> => {
  let s;
  s = searchSessionBySessionId(sessionId);
  if (s) {
    return s;
  }

  const [session] = await pool.query<RowDataPacket[]>(
    "SELECT session_id, linked_user_id, created_at FROM session WHERE session_id = ? LIMIT 1",
    [sessionId]
  );
  if (session.length === 0) {
    return;
  }

  return {
    sessionId: session[0].session_id,
    userId: session[0].linked_user_id,
    createdAt: convertDateToString(session[0].created_at),
  };
};

export const deleteSessions = async (userId: string) => {
  removeSessionsByUserId(userId);
  await pool.query("DELETE FROM session WHERE linked_user_id = ?", [userId]);
};
