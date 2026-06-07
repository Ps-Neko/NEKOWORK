// positive: Java @SuppressWarnings silences compiler warnings broadly
class LegacyAdapter {
  @SuppressWarnings("unchecked")
  List rawList() {
    return (List) backing;
  }
}
