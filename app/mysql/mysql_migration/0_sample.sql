ALTER TABLE match_group_member ADD INDEX user_id_idx(user_id);
ALTER TABLE department_role_member ADD INDEX user_id_idx(user_id, belong);
ALTER TABLE `user` ADD `id` INT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD UNIQUE (`id`);
