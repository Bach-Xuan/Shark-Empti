export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

// Image placeholders are optional. Keeping this empty avoids a runtime import of
// a generated asset that is not part of the repository.
export const PlaceHolderImages: ImagePlaceholder[] = [];
