import React from 'react'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import { renderWithProviders } from '../setup/test-utils'

describe('LoadingSpinner Component', () => {
  it('renders loading spinner', () => {
    const { container } = renderWithProviders(<LoadingSpinner />)
    
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('displays default loading message', () => {
    renderWithProviders(<LoadingSpinner />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays custom loading message', () => {
    renderWithProviders(<LoadingSpinner message="Please wait..." />)
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument()
  })

  it('renders spinner with correct classes', () => {
    const { container } = renderWithProviders(<LoadingSpinner />)
    
    const spinner = container.querySelector('.animate-spin.rounded-full')
    expect(spinner).toBeInTheDocument()
  })
})

