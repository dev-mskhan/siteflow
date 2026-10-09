export interface NotificationTemplateParams {
  recipientName?: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export function renderEmailTemplate(params: NotificationTemplateParams): { subject: string; html: string; text: string } {
  const eventType = params.eventType;
  const payload = params.payload ?? {};

  let subject = `SiteFlow Alert: ${eventType}`;
  let text = `Hello, you have a new update regarding ${eventType}. Details: ${JSON.stringify(payload)}`;

  switch (eventType) {
    case 'TaskCompleted':
      subject = `Task Completed: ${payload.taskTitle ?? payload.taskId ?? 'Site Task'}`;
      text = `The task '${payload.taskTitle ?? payload.taskId}' has been marked as completed.`;
      break;

    case 'IssueCreated':
      subject = `New Site Issue Logged: ${payload.title ?? 'Safety/Quality Issue'}`;
      text = `A new site issue has been reported: ${payload.title ?? 'Issue'}. Priority: ${payload.priority ?? 'Normal'}.`;
      break;

    case 'RfiCreated':
      subject = `New RFI Created: ${payload.subject ?? 'Request for Information'}`;
      text = `RFI '${payload.subject ?? 'RFI'}' was created and requires review.`;
      break;

    case 'ChangeOrderCreated':
      subject = `Change Order Submitted: ${payload.title ?? 'Commercial CO'}`;
      text = `Change order '${payload.title}' was created. Amount: ${payload.amount ?? 'N/A'}.`;
      break;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1e3a8a;">SiteFlow Notification</h2>
      <p style="font-size: 16px; color: #334155;">${text}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #64748b; font-size: 12px;">This is an automated notification from your SiteFlow workspace.</p>
    </div>
  `;

  return { subject, html, text };
}
