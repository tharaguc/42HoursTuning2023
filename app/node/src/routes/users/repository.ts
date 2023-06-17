import { RowDataPacket } from "mysql2";
import pool from "../../util/mysql";
import { SearchedUser, User, UserForFilter } from "../../model/types";
import {
  convertToSearchedUser,
  convertToUserForFilter,
  convertToUsers,
} from "../../model/utils";

export const getUserIdByMailAndPassword = async (
  mail: string,
  hashPassword: string
): Promise<string | undefined> => {
  const [user] = await pool.query<RowDataPacket[]>(
    "SELECT user_id FROM user WHERE mail = ? AND password = ?",
    [mail, hashPassword]
  );
  if (user.length === 0) {
    return;
  }

  return user[0].user_id;
};

export const getUsers = async (
  limit: number,
  offset: number
): Promise<User[]> => {
  const query = `SELECT user_id, user_name, office_id, user_icon_id FROM user ORDER BY entry_date ASC, kana ASC LIMIT ? OFFSET ?`;
  const rows: RowDataPacket[] = [];

  const [userRows] = await pool.query<RowDataPacket[]>(query, [limit, offset]);
  for (const userRow of userRows) {
    const [officeRows] = await pool.query<RowDataPacket[]>(
      `SELECT office_name FROM office WHERE office_id = ?`,
      [userRow.office_id]
    );
    const [fileRows] = await pool.query<RowDataPacket[]>(
      `SELECT file_name FROM file WHERE file_id = ?`,
      [userRow.user_icon_id]
    );
    userRow.office_name = officeRows[0].office_name;
    userRow.file_name = fileRows[0].file_name;
    rows.push(userRow);
  }

  return convertToUsers(rows);
};

export const getUserByUserId = async (
  userId: string
): Promise<User | undefined> => {
  const [user] = await pool.query<RowDataPacket[]>(
    "SELECT user_id, user_name, office_id, user_icon_id FROM user WHERE user_id = ?",
    [userId]
  );
  if (user.length === 0) {
    return;
  }

  const [office] = await pool.query<RowDataPacket[]>(
    `SELECT office_name FROM office WHERE office_id = ?`,
    [user[0].office_id]
  );
  const [file] = await pool.query<RowDataPacket[]>(
    `SELECT file_name FROM file WHERE file_id = ?`,
    [user[0].user_icon_id]
  );

  return {
    userId: user[0].user_id,
    userName: user[0].user_name,
    userIcon: {
      fileId: user[0].user_icon_id,
      fileName: file[0].file_name,
    },
    officeName: office[0].office_name,
  };
};

export const getUsersByUserIds = async (
  userIds: string[]
): Promise<SearchedUser[]> => {
  const chunkSize = 1000;
  const chunks = [];
  for (let i = 0; i < userIds.length; i += chunkSize) {
    chunks.push(userIds.slice(i, i + chunkSize));
  }

  const usersPromises = chunks.map((chunk) => {
    const placeHolders = chunk.map((_) => "?").join(",");
    const query = `
      SELECT
        user.user_id,
        user.user_name,
        user.kana,
        user.entry_date,
        user.office_id,
        user.user_icon_id,
        office.office_name,
        file.file_name
      FROM user
      LEFT JOIN office ON user.office_id = office.office_id
      LEFT JOIN file ON user.user_icon_id = file.file_id
      WHERE user.user_id IN (${placeHolders})
    `;
    return pool.query<RowDataPacket[]>(query, chunk);
  });

  const results = await Promise.all(usersPromises);

  let users: SearchedUser[] = [];
  results.forEach(([rows]) => {
    users = users.concat(convertToSearchedUser(rows));
  });

  return users;
};

export const getUsersByUserName = async (
  userName: string
): Promise<SearchedUser[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM user WHERE user_name LIKE ?`,
    [`%${userName}%`]
  );
  const userIds: string[] = rows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByKana = async (kana: string): Promise<SearchedUser[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM user WHERE kana LIKE ?`,
    [`%${kana}%`]
  );
  const userIds: string[] = rows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByMail = async (mail: string): Promise<SearchedUser[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM user WHERE mail LIKE ?`,
    [`%${mail}%`]
  );
  const userIds: string[] = rows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByDepartmentName = async (
  departmentName: string
): Promise<SearchedUser[]> => {
  const [departmentIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT department_id FROM department WHERE department_name LIKE ? AND active = true`,
    [`%${departmentName}%`]
  );
  const departmentIds: string[] = departmentIdRows.map(
    (row) => row.department_id
  );
  if (departmentIds.length === 0) {
    return [];
  }

  const [userIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM department_role_member WHERE department_id IN (?) AND belong = true`,
    [departmentIds]
  );
  const userIds: string[] = userIdRows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByRoleName = async (
  roleName: string
): Promise<SearchedUser[]> => {
  const [roleIdRows] = await pool.query<RowDataPacket[]>(
    // `SELECT role_id FROM role WHERE role_name LIKE ? AND active = true`,
    `SELECT role_id FROM role WHERE MATCH(role_name) AGAINST(? IN BOOLEAN MODE) AND active = true`,
    [`%${roleName}%`]
  );
  const roleIds: string[] = roleIdRows.map((row) => row.role_id);
  if (roleIds.length === 0) {
    return [];
  }

  const [userIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM department_role_member WHERE role_id IN (?) AND belong = true`,
    [roleIds]
  );
  const userIds: string[] = userIdRows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByOfficeName = async (
  officeName: string
): Promise<SearchedUser[]> => {
  const [officeIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT office_id FROM office WHERE office_name LIKE ?`,
    [`%${officeName}%`]
  );
  const officeIds: string[] = officeIdRows.map((row) => row.office_id);
  if (officeIds.length === 0) {
    return [];
  }

  const [userIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM user WHERE office_id IN (?)`,
    [officeIds]
  );
  const userIds: string[] = userIdRows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersBySkillName = async (
  skillName: string
): Promise<SearchedUser[]> => {
  const [skillIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT skill_id FROM skill WHERE skill_name LIKE ?`,
    [`%${skillName}%`]
  );
  const skillIds: string[] = skillIdRows.map((row) => row.skill_id);
  if (skillIds.length === 0) {
    return [];
  }

  const [userIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM skill_member WHERE skill_id IN (?)`,
    [skillIds]
  );
  const userIds: string[] = userIdRows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

export const getUsersByGoal = async (goal: string): Promise<SearchedUser[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    // `SELECT user_id FROM user WHERE goal LIKE ?`,
    `SELECT user_id FROM user WHERE MATCH(goal) AGAINST(? IN BOOLEAN MODE)`,
    [`%${goal}%`]
  );
  const userIds: string[] = rows.map((row) => row.user_id);

  return getUsersByUserIds(userIds);
};

let cachedCount: number | undefined;
let cacheExpiration = Date.now();

async function getUserCount() {
  const now = Date.now();

  // Check if the cache is valid, if it is return the cached value
  if (cachedCount !== undefined && now < cacheExpiration) {
    return cachedCount;
  }

  // If the cache is not valid, perform the query and update the cache
  const [[{ count }]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM user"
  );

  // Store the result in the cache and set the expiration to 10 minutes from now
  cachedCount = count;
  cacheExpiration = now + 10 * 60 * 1000; // Cache expires after 10 minutes

  return count;
}

export const getUserForFilter = async (
  userId?: string
): Promise<UserForFilter> => {
  let userRows: RowDataPacket[];
  if (!userId) {
    // get the count of all records in the table
    const count = await getUserCount();

    // generate a random offset
    const offset = Math.floor(Math.random() * count);

    // get the user record at the offset
    [userRows] = await pool.query<RowDataPacket[]>(
      "SELECT user_id, user_name, office_id, user_icon_id FROM user LIMIT 1 OFFSET ?",
      [offset]
    );
  } else {
    [userRows] = await pool.query<RowDataPacket[]>(
      "SELECT user_id, user_name, office_id, user_icon_id FROM user WHERE user_id = ?",
      [userId]
    );
  }
  const user = userRows[0];

  const [officeNameRow] = await pool.query<RowDataPacket[]>(
    `SELECT office_name FROM office WHERE office_id = ?`,
    [user.office_id]
  );
  const [fileNameRow] = await pool.query<RowDataPacket[]>(
    `SELECT file_name FROM file WHERE file_id = ?`,
    [user.user_icon_id]
  );
  const [departmentNameRow] = await pool.query<RowDataPacket[]>(
    `SELECT department_name FROM department WHERE department_id = (SELECT department_id FROM department_role_member WHERE user_id = ? AND belong = true)`,
    [user.user_id]
  );
  const [skillNameRows] = await pool.query<RowDataPacket[]>(
    `SELECT skill_name FROM skill WHERE skill_id IN (SELECT skill_id FROM skill_member WHERE user_id = ?)`,
    [user.user_id]
  );

  user.office_name = officeNameRow[0].office_name;
  user.file_name = fileNameRow[0].file_name;
  user.department_name = departmentNameRow[0].department_name;
  user.skill_names = skillNameRows.map((row) => row.skill_name);

  return convertToUserForFilter(user);
};
