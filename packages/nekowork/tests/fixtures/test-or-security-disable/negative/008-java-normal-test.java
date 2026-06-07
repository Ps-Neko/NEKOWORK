// negative: a normal JUnit test with no @Disabled / @Ignore / @SuppressWarnings
import org.junit.jupiter.api.Test;

class OrderTest {
  @Test
  void createsOrder() {
    var order = new Order();
    assert order.isValid();
  }
}
