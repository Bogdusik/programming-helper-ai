import { Resend } from 'resend'
import { logger } from './logger'

// Escape HTML to prevent XSS attacks
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

export async function sendContactEmail(data: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const TO_EMAIL = process.env.CONTACT_EMAIL

  if (!TO_EMAIL) {
    logger.error('CONTACT_EMAIL environment variable is not set')
    return { success: false, error: 'Email configuration error' }
  }

  if (!RESEND_API_KEY) {
    // If Resend is not configured, just log the message
    logger.info('Contact form submission (email service not configured)', undefined, {
      name: data.name,
      email: data.email,
      subject: data.subject,
      messageLength: data.message.length
    })
    
    return { success: true }
  }

  try {
    // Initialize Resend
    const resend = new Resend(RESEND_API_KEY)

    // Send email using Resend SDK
    const { data: emailData, error } = await resend.emails.send({
      from: 'Programming Helper AI <onboarding@resend.dev>', // Use Resend's default domain for testing, or your verified domain
      to: [TO_EMAIL],
      replyTo: data.email,
      subject: `Contact Form: ${escapeHtml(data.subject)}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>
      `,
      text: `
        New Contact Form Submission
        
        Name: ${data.name}
        Email: ${data.email}
        Subject: ${data.subject}
        
        Message:
        ${data.message}
      `,
    })

    if (error) {
      logger.error('Resend API error', undefined, {
        error: error.message
      })
      return { success: false, error: error.message }
    }

    logger.info('Email sent successfully', undefined, {
      emailId: emailData?.id
    })
    return { success: true }
  } catch (error) {
    logger.error('Error sending email', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

