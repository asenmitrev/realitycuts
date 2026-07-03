import { FC, useState } from 'react';
import { useQuery } from 'react-query';
import { Button, Flex, Text } from '@chakra-ui/react';
import { ExportCard } from '../export/ExportList';
import { ExportJob } from '../../types';
import { useApiService } from '../../hooks/useApiService';

interface ExportsListProps {
  brollId: string;
}

export const ExportsList: FC<ExportsListProps> = ({ brollId }) => {
  const [showMoreExports, setShowMoreExports] = useState(false);
  const apiService = useApiService();

  const { data: exports } = useQuery({
    queryKey: ['exportspervideo', brollId],
    enabled: !!brollId,
    queryFn: async () => {
      return await apiService.get<ExportJob[]>(`/api/exports?id=${brollId}`);
    },
    refetchInterval: false
  });

  return (
    <>
      <Flex gap={4} p={0} flexDir="column">
        {exports?.[0] && <ExportCard data={exports[0]}></ExportCard>}
        {showMoreExports ? exports?.slice(1).map(exp => <ExportCard data={exp} key={exp._id}></ExportCard>) : null}
        {!showMoreExports && (exports?.length ?? 0) > 1 ? (
          <Button size="sm" onClick={() => setShowMoreExports(true)}>
            Show Older Exports...
          </Button>
        ) : null}
      </Flex>
      {exports?.length === 0 ? (
        <Text color="gray.500" mt={4} fontSize="sm">
          No exports yet.
        </Text>
      ) : null}
    </>
  );
};
