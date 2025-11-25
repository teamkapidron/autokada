import { render } from '@react-email/render';

import { AttachmentTemplate } from './templates/attachment.template';
import { MailTemplate } from './types';

export async function getTemplate(template: MailTemplate) {
  switch (template.type) {
    case 'attachment':
      return render(AttachmentTemplate());
  }
}
