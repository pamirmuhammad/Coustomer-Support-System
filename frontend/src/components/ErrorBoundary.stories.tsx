import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary } from './ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';

// Storybook story metadata for the ErrorBoundary component
const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story showing ErrorBoundary wrapping normal content
export const Default: Story = {
  args: {
    children: <div>Application content here</div>,
  },
};
