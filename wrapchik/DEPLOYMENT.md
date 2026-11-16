# Wrapchik Deployment Guide

Nothing was deployed or published. Keep development, staging and production databases and credentials separate.

## Suggested hosting shape

- **Client:** Expo EAS builds. The app identifier and EAS project ID are already configured in the frontend.
- **API:** a managed Node host with persistent Express + Socket.IO support, TLS, health checks, environment secrets, logs and reliable uptime. Render is one prototype option, but its free services can suspend and its documentation says free instances are not for production. Use paid always-on compute for outlet operations.
- **Database:** MongoDB Atlas. M0 is a small development/proof-of-concept tier (512 MB shared cluster); choose a paid tier and backups suitable for the outlet before launch.
- **Images:** existing catalogue URLs remain. If uploads are enabled later, keep Cloudinary credentials on the backend.
- **Payments:** New orders use cash at counter or outlet-configured UPI with manual administrator verification. Legacy gateway records remain supported for historical orders.
- **Push:** configure Expo project and Android Firebase credentials for EAS builds, then verify delivery on a real test device.

Prices and limits change. Review current provider terms before committing spend: [MongoDB Atlas pricing](https://www.mongodb.com/pricing), [Render free-service limitations](https://render.com/docs/free), [Render pricing](https://render.com/pricing), and [Expo EAS plans](https://docs.expo.dev/billing/plans/). Free tiers suit demos/prototypes; do not infer production suitability from a $0 tier.

## Development

- Local MongoDB and local Express/Socket.IO backend.
- `NODE_ENV=development`; keep `SEED_SAMPLE_CATALOGUE=false` unless deliberately using a disposable database.
- Enable local OTP only in a disposable development environment.
- Keep the existing live catalogue and records intact.

## Staging

- Create a separate Atlas database and service credentials.
- Deploy the API behind HTTPS. Set exact `CORS_ORIGIN`, `TRUST_PROXY_HOPS` to the reverse-proxy hop count, a random `JWT_SECRET`, and backend email SMTP settings. Keep all private credentials in the backend host’s secret manager.
- Set the Expo staging environment’s `EXPO_PUBLIC_API_URL` to the HTTPS API URL. Never put private keys in Expo public variables.
- Verify cash and UPI workflows using clearly identified staging data; keep UPI payment pending until an administrator verifies actual receipt.

## Production preparation (not completed or authorized)

- Obtain outlet/institution owner approval, verified email sender, Firebase/Expo ownership, and production project linking.
- Use a new production MongoDB database; never reset or reseed it. Select backups/PITR, retention, access policies and monitoring. Rehearse restores into a separate database.
- Require HTTPS for app/API/webhooks. Restrict CORS to approved origins. Store credentials in host secret manager and document rotation.
- Monitor `GET /`, API error rate, process restarts, MongoDB health, Socket.IO disconnects, webhook failures, pending reconciliation, email delivery and push tickets.
- Define verified-payment order handling, cash closeout, UPI review, refunds/cancellations and support escalation before live operations.
- Require final owner review and explicit deployment approval before publishing EAS builds or routing production traffic.

## Release checks

1. Run clean installs from the backend and frontend lockfiles, then run available backend tests.
2. Verify web and Android exports and build/install a preview APK.
3. Test customer/admin, cash/UPI verification, and push workflows with separate staging data and a physical device.
4. Review security and dependency findings; do not blindly apply an Expo major upgrade.
5. Test backup restore and outlet operating procedures before production use.

## Backup and recovery

- Enable provider backups before storing live outlet data. Document backup cadence, retention, recovery owner and target recovery time.
- Before any index/schema migration, review impact, back up and test restore. No destructive migration is included in this change.
- Keep order item snapshots, catalogue and order records; never run development seed/reset scripts against staging/production.
- Follow owner-approved retention for payment verification records; never store card credentials in Wrapchik.
