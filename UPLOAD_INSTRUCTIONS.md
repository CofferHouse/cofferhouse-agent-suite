# Upload this candidate

1. Extract the ZIP locally.
2. Open the extracted `cofferhouse-scout` folder.
3. Upload its contents to the root of the GitHub repository, preserving the `api`, `contracts`, `docs`, `public`, `src`, `test`, and `.github/workflows` paths.
4. Do not upload `node_modules`, `dist`, a local `.env`, or the ZIP itself into the repository.
5. Commit the upload and wait for Vercel to deploy the new commit.
6. Open `/api/health` on the deployed domain.
7. Follow `docs/DEPLOYMENT.md` for the environment variables and GitHub Actions secrets.
8. Use `docs/RELEASE_CHECKLIST.md` during visual testing.

The application still works as a read-only browser prototype without optional credentials. The 24/7 server agent will correctly show deployment setup as incomplete until durable storage and the protected scheduler are configured.
