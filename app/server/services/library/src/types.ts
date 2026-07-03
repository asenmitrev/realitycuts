import { ILibrary, ILibraryUpload, LibraryTaskSettings } from 'shared/types';

export type ILibraryFileUpload = {
  link: ILibraryUpload;
  _id: string;
  prompt: string;
  progress: number;
  status: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
};
export type PopulatedLibrary = Omit<ILibrary, 'processedFiles'> & { processedFiles: ILibraryFileUpload[] };
