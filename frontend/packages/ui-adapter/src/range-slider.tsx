import { Label } from '@heroui/react/label';
import { Slider } from '@heroui/react/slider';

type RangeSliderProps = Readonly<{
  label: string;
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}>;

/** RangeSlider 为已在相邻区域显示数值的单轴控制提供键盘和指针交互。 */
export function RangeSlider({
  label,
  value,
  max,
  step = 1,
  disabled = false,
  onValueChange,
}: RangeSliderProps) {
  return (
    <Slider
      className="w-full min-w-0"
      value={value}
      minValue={0}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      onChange={(next) => {
        if (typeof next === 'number') onValueChange(next);
      }}
    >
      <Label className="sr-only">{label}</Label>
      <Slider.Track className="bg-surface-muted">
        <Slider.Fill className="bg-brand" />
        <Slider.Thumb className="border-border bg-surface" />
      </Slider.Track>
    </Slider>
  );
}
