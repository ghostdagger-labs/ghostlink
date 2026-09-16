# Kaspium manual authentication

Kaspium 1.3.0 supports signing a message without connecting a browser provider. Ghostlink turns the returned signature into a verified application session. This does not grant automated message or transaction access to the mobile wallet.

1. Select the intended network in the application. For a `kaspa:` receiving address, choose Mainnet.
2. Choose Kaspium and copy the full public receiving address from the wallet into Ghostlink. Spaces and line breaks are allowed as display formatting; the SDK removes them before issuing a challenge. The official backend address validator checks the checksum. Ghostlink never guesses or repairs address characters.
3. In Kaspium, open **Settings → Advanced → Sign message**. Choose the exact receiving address entered in Ghostlink.
4. Create the Ghostlink login message. Use the QR button **inside Kaspium’s message field**, or copy/paste the complete message into that field. The wallet’s home-screen scanner expects payment/address data and does not accept this login QR.
5. Review the application domain, account and network in the message. Sign it in Kaspium, then copy the signature or display its signature QR.
6. Paste the signature into Ghostlink, scan it with the computer camera, or upload an image of the signature QR. Click **Verify and sign in**, then try the protected API in the showcase.

Messages expire after five minutes. If expired, generate a fresh message and sign that message; an older signature cannot authenticate a new challenge. Never truncate the message or edit it after signing. Authentication still requires backend verification of the exact stored bytes.

If the address fails validation, copy it directly from Kaspium and compare the complete value; image text recognition can confuse characters such as `q` and `a`. An unknown or unsupported address type is rejected. No private key or seed phrase is needed.

The authenticated card reports **Authentication only**. Backend session restoration and logout work; automated wallet operations remain unavailable because manual signing provides no live provider or account/network monitoring.

Versioned sources: [Advanced menu](https://github.com/azbuky/kaspium_wallet/blob/v1.3.0/lib/settings_advanced/advanced_menu.dart), [message input/signature copy](https://github.com/azbuky/kaspium_wallet/blob/v1.3.0/lib/sign_message/sign_message_sheet.dart). Live results are recorded separately in [the compatibility matrix](../testing/compatibility-v1.json).
