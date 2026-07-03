import { Stack, FormControl, FormLabel, Select } from '@chakra-ui/react';
import {
  DEPTH_OF_FIELD_CATEGORIES_REVERSE,
  CAMERA_ANGLE_CATEGORIES_REVERSE,
  FRAMING_CATEGORIES_REVERSE,
  PERSPECTIVE_CATEGORIES_REVERSE,
  COMPLEXITY_CATEGORIES_REVERSE,
  FOCUS_POSITION_CATEGORIES_REVERSE,
  IPopulatedLibrary
} from '../../types';

interface MetadataFilters {
  framing: string;
  cameraAngle: string;
  perspective: string;
  depthOfField: string;
  complexity: string;
  arollBroll: string;
  focusPosition: string;
  clusterId: string;
}

interface LibraryFiltersProps {
  filters: MetadataFilters;
  onFilterChange: (filters: MetadataFilters) => void;
  library?: IPopulatedLibrary;
}

export const LibraryFilters = ({ filters, onFilterChange, library }: LibraryFiltersProps) => {
  const updateFilter = (key: keyof MetadataFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <Stack direction={['column', 'row']} spacing={4}>
      <FormControl>
        <FormLabel>Framing</FormLabel>
        <Select value={filters.framing} onChange={e => updateFilter('framing', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(FRAMING_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Camera Angle</FormLabel>
        <Select value={filters.cameraAngle} onChange={e => updateFilter('cameraAngle', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(CAMERA_ANGLE_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Perspective</FormLabel>
        <Select value={filters.perspective} onChange={e => updateFilter('perspective', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(PERSPECTIVE_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Depth of Field</FormLabel>
        <Select value={filters.depthOfField} onChange={e => updateFilter('depthOfField', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(DEPTH_OF_FIELD_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Complexity</FormLabel>
        <Select value={filters.complexity} onChange={e => updateFilter('complexity', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(COMPLEXITY_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Focus Position</FormLabel>
        <Select value={filters.focusPosition} onChange={e => updateFilter('focusPosition', e.target.value)}>
          <option value="">Any</option>
          {Object.entries(FOCUS_POSITION_CATEGORIES_REVERSE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>A-Roll/B-Roll</FormLabel>
        <Select value={filters.arollBroll} onChange={e => updateFilter('arollBroll', e.target.value)}>
          <option value="">Any</option>
          <option value="AROLL">A-Roll</option>
          <option value="BROLL">B-Roll</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Cluster</FormLabel>
        <Select value={filters.clusterId} onChange={e => updateFilter('clusterId', e.target.value)}>
          <option value="">Any</option>
          {library?.clusteringMetadata?.clusterStats?.map(cluster => (
            <option key={cluster.clusterId} value={cluster.clusterId.toString()}>
              Cluster {cluster.clusterId} ({cluster.videoCount} videos)
              {cluster.keywords && cluster.keywords.length > 0 && ` - ${cluster.keywords.slice(0, 3).join(', ')}`}
            </option>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};
