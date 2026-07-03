import { FC } from 'react';
import { Box, BoxProps, Image } from '@chakra-ui/react';
import logoSrc from '../../assets/logo-beta.png';

const Logo: FC<BoxProps> = props => {
  return (
    <Box {...props} display="flex" alignItems="center">
      <Image src={logoSrc} alt="logo" mr={3} maxH="40px" />
    </Box>
  );
};
export default Logo;
