import type { BackgroundImage } from '../../types';

interface Props {
  image: BackgroundImage | null;
  onPick: () => void;
}

export function ImagePanel({ image, onPick }: Props) {
  return (
    <>
      <button className="btn block" type="button" onClick={onPick}>
        {image ? 'החלפת תמונת רקע' : 'בחירת תמונת רקע'}
      </button>
      {image && <img className="bg-thumb" src={image.url} alt="" />}
    </>
  );
}
