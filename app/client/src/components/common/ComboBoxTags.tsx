import React from 'react';
import { Tag, TagLabel, TagCloseButton, Wrap, WrapItem, VStack } from '@chakra-ui/react';
import { ComboBox } from './ComboBox';

export const ComboBoxTags: React.FC<{
  options: { tag: string; libraryId: string | null; videoCount: number }[];
  onChange?: (selected: { tag: string; libraryId: string | null; videoCount: number }[]) => void;
  value: { tag: string; libraryId: string | null; videoCount: number }[];
}> = ({ options, onChange, value }) => {
  const handleTagRemove = (item: { tag: string; libraryId: string | null; videoCount: number }) => {
    const newValue = value?.filter(i => i !== item);
    onChange?.(newValue ?? []);
  };
  return (
    <VStack spacing={4} align="stretch">
      <ComboBox
        items={options.filter(option => !value?.find(item => item.tag === option.tag))}
        itemToString={item => `${item?.tag || ''} ${(item?.videoCount ?? 0) > 0 ? `(${item?.videoCount})` : ''}`}
        onSelectedItemChange={item => {
          if (item) {
            const newValue = [...(value ?? []), item];
            onChange?.(newValue);
          }
        }}
        selectedItems={value}
        placeholder="Tags"
      />

      <Wrap spacing={2}>
        {value.map(item => (
          <WrapItem key={item.tag + item.libraryId}>
            <Tag size="md" borderRadius="full" variant="solid" colorScheme="gray">
              <TagLabel>
                {item.tag} {item.videoCount > 0 ? `(${item.videoCount})` : null}
              </TagLabel>
              <TagCloseButton onClick={() => handleTagRemove(item)} />
            </Tag>
          </WrapItem>
        ))}
      </Wrap>
    </VStack>
  );
};
