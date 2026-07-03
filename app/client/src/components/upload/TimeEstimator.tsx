import { FormHelperText } from '@chakra-ui/react';
import { approximateMinutesFromText } from 'shared/utils/misc';
import React, { FC } from 'react';
import { secondsToTimestamp } from '../../utils';

export const TimeEstimator: FC<{ script: string }> = React.memo(({ script }) => {
  return (
    <FormHelperText>Approximate time: {secondsToTimestamp(approximateMinutesFromText(script) * 60)}</FormHelperText>
  );
});
