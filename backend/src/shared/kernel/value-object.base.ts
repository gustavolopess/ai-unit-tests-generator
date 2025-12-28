export abstract class ValueObject {
  protected abstract getAtomicValues(): Generator<unknown>;

  public equals(other: ValueObject): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this.constructor !== other.constructor) {
      return false;
    }

    const thisValues = Array.from(this.getAtomicValues());
    const otherValues = Array.from(other.getAtomicValues());

    if (thisValues.length !== otherValues.length) {
      return false;
    }

    return thisValues.every((value, index) => value === otherValues[index]);
  }
}
