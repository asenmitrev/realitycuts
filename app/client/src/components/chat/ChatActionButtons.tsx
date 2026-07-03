import { FC } from 'react';
import { Button, HStack, Icon } from '@chakra-ui/react';
import { IconType } from 'react-icons';

/**
 * Configurable action button descriptor.
 * Use this to define buttons that appear inline in the chat,
 * each with its own label, callback, and optional styling.
 */
export interface ChatAction {
  /** Unique key for React rendering */
  key: string;
  /** Button label */
  label: string;
  /** Callback when clicked */
  onClick: () => void;
  /** Optional react-icons icon */
  icon?: IconType;
  /** Chakra color scheme (defaults to "teal") */
  colorScheme?: string;
  /** Optional variant override (defaults to "outline") */
  variant?: string;
  /** Disable the button */
  isDisabled?: boolean;
}

interface ChatActionButtonsProps {
  actions: ChatAction[];
}

/**
 * Renders a row of configurable action buttons inline in the chat.
 * Each action is fully configurable – label, icon, callback, color, etc.
 */
export const ChatActionButtons: FC<ChatActionButtonsProps> = ({ actions }) => {
  if (actions.length === 0) return null;

  return (
    <HStack spacing={3} py={3} px={1} flexWrap="wrap">
      {actions.map(({ key, label, onClick, icon, colorScheme = 'teal', variant = 'outline', isDisabled }) => (
        <Button
          key={key}
          size="sm"
          variant={variant}
          colorScheme={colorScheme}
          leftIcon={icon ? <Icon as={icon} /> : undefined}
          onClick={onClick}
          isDisabled={isDisabled}
          borderRadius="full"
          px={5}
          fontWeight="500"
          _hover={{
            transform: 'translateY(-1px)',
            shadow: 'md',
          }}
          transition="all 0.2s"
        >
          {label}
        </Button>
      ))}
    </HStack>
  );
};
