'use client'

import { useState } from 'react'

interface ResearchConsentProps {
  onConsent: (consent: boolean) => void
}

export default function ResearchConsent({ onConsent }: ResearchConsentProps) {
  const [hasRead, setHasRead] = useState(false)
  const [, setConsentGiven] = useState(false)

  const handleConsent = (consent: boolean) => {
    setConsentGiven(consent)
    onConsent(consent)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Research Participation Consent</h2>
        
        <div className="space-y-4 text-gray-700">
          <p className="font-semibold">You are being invited to participate in a research study about AI-assisted programming learning.</p>
          
          <div>
            <h3 className="font-semibold mb-2">What will happen:</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You will use an AI programming assistant to complete programming tasks</li>
              <li>Your interactions with the AI will be recorded for research purposes</li>
              <li>You may be asked to complete brief assessments</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Data Protection:</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>No personal information will be collected</strong> - your identity remains anonymous</li>
              <li>All data will be anonymized and securely stored</li>
              <li>Data will only be used for academic research purposes</li>
              <li>You can withdraw at any time without penalty</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Your Rights:</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Participation is completely voluntary</li>
              <li>You can withdraw at any time</li>
              <li>Your data will be deleted upon withdrawal</li>
              <li>No personal information is collected</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm">
              <strong>Important:</strong> By participating, you consent to the anonymous collection of your 
              programming interactions for research purposes only. No personal data will be stored.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-600">
              I have read and understood the above information
            </span>
          </label>

          <div className="flex space-x-4">
            <button
              onClick={() => handleConsent(true)}
              disabled={!hasRead}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              I Consent to Participate
            </button>
            <button
              onClick={() => handleConsent(false)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Decline Participation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
