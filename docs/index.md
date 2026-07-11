# ALM System Docs

- [Local setup and usage](../README.md)
- [Docker Compose deployment](./deployment.md)
- [Overview](./overview.md)

Multi-user behavior summary:

- Database-backed users sign in through `/login`.
- If `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` are unset and no users
  exist, first-run setup uses `/setup` with the setup token to create the first
  administrator account.
- Administrators manage users from `/manage/users`.
