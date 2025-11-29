import {
  checkPostAssessmentEligibility,
  getPostAssessmentMessage,
} from '../../lib/assessment-utils'

describe('assessment-utils.ts', () => {
  describe('checkPostAssessmentEligibility', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('returns eligible when all requirements are met', () => {
      const registrationDate = new Date('2024-01-01T12:00:00Z') // 14 days ago
      const result = checkPostAssessmentEligibility(
        registrationDate,
        25, // 25 questions (>= 20)
        6,  // 6 tasks (>= 5)
        3600 // 1 hour in seconds
      )

      expect(result.isEligible).toBe(true)
      expect(result.daysSinceRegistration).toBe(14)
      expect(result.questionsAsked).toBe(25)
      expect(result.tasksCompleted).toBe(6)
    })

    it('returns not eligible when days requirement not met', () => {
      const registrationDate = new Date('2024-01-10T12:00:00Z') // 5 days ago
      const result = checkPostAssessmentEligibility(
        registrationDate,
        25,
        6,
        3600
      )

      expect(result.isEligible).toBe(false)
      expect(result.daysSinceRegistration).toBe(5)
    })

    it('returns not eligible when questions requirement not met', () => {
      const registrationDate = new Date('2024-01-01T12:00:00Z')
      const result = checkPostAssessmentEligibility(
        registrationDate,
        10, // Only 10 questions (< 20)
        6,
        3600
      )

      expect(result.isEligible).toBe(false)
      expect(result.questionsAsked).toBe(10)
    })

    it('returns not eligible when tasks requirement not met', () => {
      const registrationDate = new Date('2024-01-01T12:00:00Z')
      const result = checkPostAssessmentEligibility(
        registrationDate,
        25,
        3, // Only 3 tasks (< 5)
        3600
      )

      expect(result.isEligible).toBe(false)
      expect(result.tasksCompleted).toBe(3)
    })

    it('calculates progress percentage correctly', () => {
      const registrationDate = new Date('2024-01-08T12:00:00Z') // 7 days (50% of 14)
      const result = checkPostAssessmentEligibility(
        registrationDate,
        10, // 50% of 20
        3,  // 60% of 5
        3600
      )

      // Average of 50%, 50%, 60% = 53.33% rounded to 53%
      expect(result.progressPercentage).toBeGreaterThan(50)
      expect(result.progressPercentage).toBeLessThan(60)
    })

    it('caps progress at 100%', () => {
      const registrationDate = new Date('2023-12-01T12:00:00Z') // Way more than 14 days
      const result = checkPostAssessmentEligibility(
        registrationDate,
        100, // Way more than 20
        20,  // Way more than 5
        3600
      )

      expect(result.progressPercentage).toBe(100)
    })

    it('returns correct minimum requirements', () => {
      const registrationDate = new Date('2024-01-01T12:00:00Z')
      const result = checkPostAssessmentEligibility(
        registrationDate,
        25,
        6,
        3600
      )

      expect(result.minDaysRequired).toBe(14)
      expect(result.minQuestionsRequired).toBe(20)
      expect(result.minTasksRequired).toBe(5)
    })
  })

  describe('getPostAssessmentMessage', () => {
    it('returns success message when eligible', () => {
      const eligibility = {
        isEligible: true,
        daysSinceRegistration: 14,
        questionsAsked: 25,
        tasksCompleted: 6,
        totalTimeSpent: 3600,
        minDaysRequired: 14,
        minQuestionsRequired: 20,
        minTasksRequired: 5,
        progressPercentage: 100,
      }

      const message = getPostAssessmentMessage(eligibility)
      // The message for eligible users is "You're ready for post-assessment!"
      expect(message).toBe("You're ready for post-assessment!")
    })

    it('returns progress message when not eligible', () => {
      const eligibility = {
        isEligible: false,
        daysSinceRegistration: 7,
        questionsAsked: 10,
        tasksCompleted: 3,
        totalTimeSpent: 1800,
        minDaysRequired: 14,
        minQuestionsRequired: 20,
        minTasksRequired: 5,
        progressPercentage: 50,
      }

      const message = getPostAssessmentMessage(eligibility)
      // The message format is "Complete X more days, Y more questions, Z more tasks to unlock post-assessment"
      // It doesn't contain "progress" or percentage, it contains the actual requirements
      expect(message).toContain('more day')
      expect(message).toContain('more question')
      expect(message).toContain('more task')
    })
  })
})

