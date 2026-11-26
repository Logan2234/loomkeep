// What the auth module tells the layers above it. It publishes these with
// EventEmitter2.emitAsync() rather than importing the modules that react:
// auth sits in the platform layer, below social and gamification
// (docs/adr/0010-module-layers.md). emitAsync awaits every listener, so a
// listener runs before the request answers, and its error reaches the caller.

/** Someone signed up through a member's personal invitation link. */
export class PersonalInvitationAcceptedEvent {
  static readonly NAME = "auth.personal-invitation-accepted";

  constructor(
    readonly inviterId: string,
    readonly userId: string,
  ) {}
}

/** A user confirmed an authenticator app as their second factor. */
export class TotpEnabledEvent {
  static readonly NAME = "auth.totp-enabled";

  constructor(readonly userId: string) {}
}
