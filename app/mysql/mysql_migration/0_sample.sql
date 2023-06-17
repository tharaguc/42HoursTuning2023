ALTER TABLE match_group_member ADD INDEX user_id_idx(user_id);
ALTER TABLE department_role_member ADD INDEX user_id_idx(user_id, belong);
-- ALTER TABLE `user` ADD `id` INT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD UNIQUE (`id`);
ALTER TABLE user ADD COLUMN id INT;
SET @id := 0;
UPDATE user SET id = (@id := @id + 1) ORDER BY user_id;

CREATE INDEX idx_role_id_belong ON department_role_member(role_id, belong);
CREATE INDEX idx_mail_password ON user (mail, password);


