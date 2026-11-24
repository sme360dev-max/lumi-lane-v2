import { ResponsivePicture } from './ResponsivePicture';

interface TablePictureProps {
  dish: 'food' | 'coffee' | 'mezze';
  second?: 'food' | 'coffee' | 'mezze';
  priority?: boolean;
}

export function TablePicture({ dish, second, priority }: TablePictureProps) {
  return (
    <div className="table-picture" data-pair={Boolean(second)} aria-hidden="true">
      <div className="table-picture-linen" />
      <ResponsivePicture
        name={dish}
        widths={[480, 800, 1254]}
        sizes="(min-width: 760px) 34vw, 65vw"
        width={1254}
        height={1254}
        alt=""
        className="table-picture-dish"
        priority={priority}
      />
      {second && (
        <ResponsivePicture
          name={second}
          widths={[480, 800]}
          sizes="(min-width: 760px) 22vw, 36vw"
          width={800}
          height={800}
          alt=""
          className="table-picture-second"
          priority={priority}
        />
      )}
    </div>
  );
}
