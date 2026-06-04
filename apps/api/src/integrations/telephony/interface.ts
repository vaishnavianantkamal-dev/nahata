export interface TelephonyProvider {
  clickToCall(agentNumber: string, leadNumber: string, opts?: { callerId?: string }): Promise<{ providerCallId: string }>;
  fetchRecording(providerCallId: string): Promise<{ url: string }>;
  verifyWebhook(req: any): boolean;
}
