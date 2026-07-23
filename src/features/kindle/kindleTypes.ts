export type KindleSettings = {
  user_id: string;
  kindle_email: string;
  created_at: string;
  updated_at: string;
};

export type SaveKindleSettingsInput = {
  userId: string;
  kindleEmail: string;
};

export type SendToKindleResult = {
  sent: true;
};
