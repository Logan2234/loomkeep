// Short-lived signed token for Quackback's feedback widget "Verified
// identity only" mode — the widget trusts this signature instead of letting
// the visitor type in their own email.
export interface WidgetTokenDto {
  ssoToken: string;
}
