-- Emails and usernames are stored lowercase (the app lowercases them on the
-- way in), so their unique indexes also refuse two accounts that differ only
-- by case. Rows from before username edits were lowercased are folded first.
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "User" SET "username" = lower("username") WHERE "username" <> lower("username");

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "User_username_lowercase_check" CHECK ("username" = lower("username"));
