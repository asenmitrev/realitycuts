import {
  Popover,
  PopoverTrigger,
  Button,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  Portal,
  Box
} from '@chakra-ui/react';
import { FC } from 'react';
import { SketchPicker } from 'react-color';
import { Controller, FieldValues, Validate, ValidationRule } from 'react-hook-form';

interface ColorInputProps {
  name: string;
  rules?: ControlRules;
}

interface ControlRules {
  required?: ValidationRule<boolean>;
  validate?: Validate<string, FieldValues>;
}

export const ColorInput: FC<ColorInputProps> = ({ name, rules }) => {
  return (
    <Controller
      name={name}
      rules={rules}
      render={({ field }) => {
        return (
          <Popover closeOnBlur={true}>
            <PopoverTrigger>
              <Button
                borderRadius="full"
                height="40px"
                width="40px"
                background="whiteAlpha.200"
                border="1px solid #555"
                display="block"
                p="4px"
              >
                <Box width="30px" height="30px" background={field.value} borderRadius="full"></Box>
              </Button>
            </PopoverTrigger>
            <Portal>
              <Box zIndex={10000} position="relative">
                <PopoverContent w="auto">
                  <PopoverArrow />
                  <PopoverCloseButton />
                  <PopoverHeader>Choose Color</PopoverHeader>
                  <SketchPicker
                    disableAlpha
                    color={field.value}
                    onChange={v => {
                      field.onChange(v.hex);
                    }}
                  />
                </PopoverContent>
              </Box>
            </Portal>
          </Popover>
        );
      }}
    />
  );
};
