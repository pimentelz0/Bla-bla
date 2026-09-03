const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * Cloud Function triggered when a new message is added to Firestore.
 * Automatically sends FCM push notifications to all registered device tokens of the recipient.
 * Cleans up expired or invalid tokens automatically.
 */
exports.sendPushNotificationOnNewMessage = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const message = snapshot.data();
    const messageId = event.params.messageId;
    const recipientId = message.recipientId;
    const senderId = message.senderId;
    const senderName = message.senderName || message.senderUsername || "Blá Blá";
    const content = message.content || message.text || "Nova mensagem";
    const chatId = message.chatId || senderId;

    if (!recipientId) {
      console.log(`[FCM] Message ${messageId} has no recipientId. Skipping.`);
      return;
    }

    console.log(`[FCM] Processing new message ${messageId} from ${senderId} to ${recipientId}`);

    try {
      // 1. Fetch all FCM tokens registered for the recipient
      const tokensQuery = await db
        .collection("fcm_tokens")
        .where("userId", "==", recipientId)
        .get();

      if (tokensQuery.empty) {
        console.log(`[FCM] No registered device tokens found for user ${recipientId}.`);
        return;
      }

      const tokenDocs = tokensQuery.docs;
      const registrationTokens = tokenDocs
        .map((doc) => doc.data().token)
        .filter(Boolean);

      if (registrationTokens.length === 0) {
        console.log(`[FCM] User ${recipientId} has no valid token strings.`);
        return;
      }

      console.log(`[FCM] Sending push to ${registrationTokens.length} device(s) for user ${recipientId}`);

      const chatUrl = `/?chat=${encodeURIComponent(chatId)}`;

      // 2. Build the Multicast message payload
      const payload = {
        tokens: registrationTokens,
        notification: {
          title: `@${senderName.replace(/^@/, "")}`,
          body: content,
        },
        data: {
          chatId: String(chatId),
          senderId: String(senderId),
          messageId: String(messageId),
          url: chatUrl,
          click_action: chatUrl,
        },
        webpush: {
          fcmOptions: {
            link: chatUrl,
          },
          headers: {
            Urgency: "high",
          },
          notification: {
            title: `@${senderName.replace(/^@/, "")}`,
            body: content,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [300, 100, 300, 100, 300],
            tag: `chat_${chatId}`,
            renotify: true,
            requireInteraction: true,
            data: {
              chatId: String(chatId),
              senderId: String(senderId),
              url: chatUrl,
            },
          },
        },
      };

      // 3. Dispatch to all recipient devices
      const response = await messaging.sendEachForMulticast(payload);
      console.log(
        `[FCM] Notification results: ${response.successCount} succeeded, ${response.failureCount} failed.`
      );

      // 4. Handle expired / invalid tokens and clean them up
      if (response.failureCount > 0) {
        const batch = db.batch();
        let tokensToRemove = 0;

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            console.warn(`[FCM] Error for token index ${idx}:`, errorCode, resp.error.message);

            // Tokens that are no longer valid or unregistered
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              const badDoc = tokenDocs[idx];
              if (badDoc) {
                console.log(`[FCM] Deleting invalid/expired token document: ${badDoc.id}`);
                batch.delete(badDoc.ref);
                tokensToRemove++;
              }
            }
          }
        });

        if (tokensToRemove > 0) {
          await batch.commit();
          console.log(`[FCM] Cleaned up ${tokensToRemove} stale token(s) from Firestore.`);
        }
      }
    } catch (err) {
      console.error("[FCM] Error in sendPushNotificationOnNewMessage:", err);
    }
  }
);
