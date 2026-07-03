import { useCombobox } from 'downshift';
import { Box, Input, List, ListItem, useColorModeValue } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

interface ComboBoxProps<T> {
  items: T[];
  itemToString: (item: T | null) => string;
  onSelectedItemChange?: (item: T | null) => void;
  selectedItems: T[];
  placeholder?: string;
}

export function ComboBox<T>({
  items,
  itemToString,
  onSelectedItemChange,
  placeholder,
  selectedItems
}: ComboBoxProps<T>) {
  const filteredItems = useMemo(() => {
    return items.filter(item => !selectedItems.find(selItem => selItem === item));
  }, [items, selectedItems]);
  const [inputItems, setInputItems] = useState(filteredItems);
  const bgColor = useColorModeValue('white', 'black');
  const hoverBgColor = useColorModeValue('gray.100', 'gray.800');
  const { isOpen, getMenuProps, getInputProps, highlightedIndex, getItemProps, reset } = useCombobox({
    items: inputItems,
    itemToString,
    onInputValueChange: ({ inputValue }) => {
      const filteredItems = items.filter(item =>
        itemToString(item)
          .toLowerCase()
          .includes(inputValue?.toLowerCase() || '')
      );
      setInputItems(filteredItems);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      onSelectedItemChange?.(selectedItem || null);
      reset();
    }
  });

  return (
    <Box position="relative">
      <Input {...getInputProps()} placeholder={placeholder} />
      <List
        {...getMenuProps()}
        position="absolute"
        width="100%"
        maxH="200px"
        overflowY="auto"
        bg={bgColor}
        boxShadow="lg"
        display={isOpen && inputItems.length > 0 ? undefined : 'none'}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        mt={1}
        zIndex={1000}
      >
        {isOpen &&
          inputItems.map((item, index) => (
            <ListItem
              key={`${itemToString(item)}-${index}`}
              {...getItemProps({ item, index })}
              px={4}
              py={2}
              bg={highlightedIndex === index ? hoverBgColor : 'transparent'}
              cursor="pointer"
              _hover={{ bg: hoverBgColor }}
              borderBottom={index < inputItems.length - 1 ? '1px solid' : 'none'}
              borderColor="gray.200"
            >
              {itemToString(item)}
            </ListItem>
          ))}
      </List>
    </Box>
  );
}
