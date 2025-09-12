// WhatsApp Message Templates

const messageTemplates = {
  // Order confirmation template
  orderConfirmation: (orderData) => {
    const { invoice, customerName, totalAmount, items, shopName, shopAddress } = orderData;
    return `🛍️ *Order Confirmation - ${shopName}*\n\nHi ${customerName}!\n\nThank you for your purchase!\n\n📋 *Order Details:*\nInvoice: ${invoice}\nTotal: $${totalAmount}\n\n📦 *Items:*\n${items.map(item => `• ${item.name} x${item.quantity} - $${item.total}`).join('\n')}\n\n📍 *Store Information:*\n• Location: ${shopAddress}\n\nWe appreciate your business! 🙏`;
  },

  // Payment reminder template
  paymentReminder: (orderData) => {
    const { invoice, customerName, totalAmount, dueAmount, shopName } = orderData;
    return `💳 *Payment Reminder - ${shopName}*\n\nHi ${customerName},\n\nThis is a friendly reminder about your pending payment.\n\n📋 *Order Details:*\nInvoice: ${invoice}\nTotal Amount: $${totalAmount}\nPending Amount: $${dueAmount}\n\nPlease complete your payment at your earliest convenience.\n\nThank you! 🙏`;
  },

  // Low stock alert template
  lowStockAlert: (itemData) => {
    const { itemName, currentStock, minStock, shopName } = itemData;
    return `⚠️ *Low Stock Alert - ${shopName}*\n\n📦 *Item:* ${itemName}\n📊 *Current Stock:* ${currentStock}\n📉 *Minimum Required:* ${minStock}\n\nPlease restock this item soon to avoid stockouts.`;
  },

  // Welcome message template
  welcomeMessage: (customerData) => {
    const { customerName, shopName, loyaltyPoints } = customerData;
    return `🎉 *Welcome to ${shopName}!*\n\nHi ${customerName}!\n\nThank you for joining us! You've earned ${loyaltyPoints || 0} loyalty points.\n\nWe look forward to serving you! 🛍️`;
  },

  // Promotional message template
  promotional: (promoData) => {
    const { customerName, offerTitle, offerDetails, validUntil, shopName } = promoData;
    return `🎁 *Special Offer - ${shopName}*\n\nHi ${customerName}!\n\n✨ *${offerTitle}*\n\n${offerDetails}\n\n⏰ *Valid until:* ${validUntil}\n\nDon't miss out! Visit us today! 🛍️`;
  },

  // Custom message template
  custom: (messageData) => {
    const { customerName, message, shopName } = messageData;
    return `📢 *${shopName}*\n\nHi ${customerName},\n\n${message}\n\nThank you! 🙏`;
  },

  // Order ready for pickup template
  orderReady: (orderData) => {
    const { invoice, customerName, shopName, shopAddress } = orderData;
    return `✅ *Order Ready for Pickup - ${shopName}*\n\nHi ${customerName}!\n\nGreat news! Your order ${invoice} is ready for pickup.\n\n📍 *Pickup Location:*\n${shopAddress}\n\nPlease bring this message when collecting your order.\n\nThank you! 🙏`;
  },

  // Birthday wishes template
  birthdayWish: (customerData) => {
    const { customerName, shopName, specialOffer } = customerData;
    return `🎂 *Happy Birthday - ${shopName}*\n\nHappy Birthday ${customerName}! 🎉\n\nWishing you a wonderful day filled with joy!\n\n${specialOffer ? `🎁 *Special Birthday Offer:*\n${specialOffer}` : ''}\n\nCelebrate with us! 🛍️`;
  }
};

module.exports = messageTemplates;